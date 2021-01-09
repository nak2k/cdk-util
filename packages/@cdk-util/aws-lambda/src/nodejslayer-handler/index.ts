import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { Lambda, S3 } from 'aws-sdk';
import { promises } from 'fs';
import { spawn, SpawnOptions } from 'child_process';
import { tmpdir } from 'os';
import { zipFiles } from 'jszip-glob';
import JSZip = require('jszip');

const { rmdir, mkdir, writeFile } = promises;

const TMPDIR = tmpdir();

export type HandlerResponse = undefined | {
  Data?: any;
  PhysicalResourceId?: string;
  Reason?: string;
  NoEcho?: boolean;
};

interface NodejsLayerVersionProperties {
  ServiceToken: string;
  Package?: {
    Bucket: string;
    Key: string;
  };
  PackageLock?: {
    Bucket: string;
    Key: string;
  };
}

export async function handler(event: CloudFormationCustomResourceEvent): Promise<HandlerResponse> {
  return dispatcher(event).catch((err: Error) => {
    console.error(err);

    throw err;
  });
}

async function dispatcher(event: CloudFormationCustomResourceEvent): Promise<HandlerResponse> {
  switch (event.RequestType) {
    case 'Create': {
      const {
        LogicalResourceId,
        ResourceProperties,
      } = event;

      const props = ResourceProperties as NodejsLayerVersionProperties;

      if (props.Package && props.PackageLock) {
        throw new Error('Either Package or PackageLock must be specified');
      }

      const layerVersion = await publishLayer(LogicalResourceId, props);

      return {
        PhysicalResourceId: layerVersion.LayerVersionArn!,
        Reason: `The lambda layer ${LogicalResourceId} has been created`,
      };
    }

    case 'Update': {
      const {
        LogicalResourceId,
        PhysicalResourceId,
        ResourceProperties,
        OldResourceProperties,
      } = event;

      const props = ResourceProperties as NodejsLayerVersionProperties;
      const oldProps = OldResourceProperties as NodejsLayerVersionProperties;

      if (props.Package && props.PackageLock) {
        throw new Error('Either Package or PackageLock must be specified');
      }

      if ((props.Package && oldProps.Package &&
        props.Package.Bucket === oldProps.Package.Bucket &&
        props.Package.Key === oldProps.Package.Key)
        || (props.PackageLock && oldProps.PackageLock &&
          props.PackageLock.Bucket === oldProps.PackageLock.Bucket &&
          props.PackageLock.Key === oldProps.PackageLock.Key)) {
        return {
          PhysicalResourceId,
          Reason: `The lambda layer ${LogicalResourceId} has not been modified`,
        };
      }

      const layerVersion = await publishLayer(LogicalResourceId, props);

      return {
        PhysicalResourceId: layerVersion.LayerVersionArn!,
        Reason: `The lambda layer ${LogicalResourceId} has been updated`,
      };
    }

    case 'Delete': {
      const {
        LogicalResourceId,
      } = event;

      const lambda = new Lambda();

      const layerVersions = await lambda.listLayerVersions({
        LayerName: LogicalResourceId,
      }).promise();

      if (!layerVersions.LayerVersions) {
        throw new Error(`The lambda layer ${LogicalResourceId} not found`);
      }

      await Promise.all(layerVersions.LayerVersions.map(layerVersion => {
        return lambda.deleteLayerVersion({
          LayerName: LogicalResourceId,
          VersionNumber: layerVersion.Version!,
        }).promise();
      }));

      return {
        Reason: `The lambda layer ${LogicalResourceId} has been deleted`,
      };
    }
  }
}

async function publishLayer(layerNme: string, props: NodejsLayerVersionProperties) {
  await rmdir(`${TMPDIR}/nodejs`, { recursive: true }).catch(_err => { });
  await mkdir(`${TMPDIR}/nodejs`, { recursive: true });

  const s3 = new S3();

  const objectInfo = props.Package
    ? {
      Bucket: props.Package.Bucket,
      Key: props.Package.Key,
    } : {
      Bucket: props.PackageLock!.Bucket,
      Key: props.PackageLock!.Key,
    };

  const packageLockS3Object = await s3.getObject(objectInfo).promise();

  if (!packageLockS3Object.Body) {
    throw new Error(`The S3 object s3://${objectInfo.Bucket}/${objectInfo.Key} must not be empty`);
  }

  const usePackageLock = props.PackageLock;
  const fileName = usePackageLock ? 'package-lock.json' : 'package.json';

  await writeFile(`${TMPDIR}/nodejs/${fileName}`, packageLockS3Object.Body.toString());

  await spawnPromise('npm', [usePackageLock ? 'ci' : 'install', '--production'], {
    cwd: `${TMPDIR}/nodejs`,
    stdio: 'inherit',
    env: {
      ...process.env,
      HOME: TMPDIR,
    },
  });

  console.log('Find files that add to the zip file');

  const zip = await zipFiles('nodejs/**/*', {
    cwd: TMPDIR,
    nodir: true,
    zip: new JSZip(),
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    }
  });

  console.log('Generate the zip file');

  const ZipFile = await zip.generateAsync({ type: 'nodebuffer' });

  console.log(`Publish the layer version ${layerNme}`);

  const lambda = new Lambda();

  return lambda.publishLayerVersion({
    LayerName: layerNme,
    CompatibleRuntimes: ['nodejs'],
    Content: {
      ZipFile,
    },
  }).promise();
}

async function spawnPromise(cmd: string, args: string[], options: SpawnOptions) {
  console.log(`Spawn: ${cmd} ${args.join(' ')}`);

  return new Promise<void>((resolve, reject) => {
    spawn(cmd, args, options)
      .on('exit', code => {
        if (code !== 0) {
          throw new Error(`Exit code is ${code}`);
        }

        resolve();
      })
      .on('error', err => {
        reject(err);
      });
  });
}
