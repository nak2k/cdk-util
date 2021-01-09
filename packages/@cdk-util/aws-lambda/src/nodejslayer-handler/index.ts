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
  Package: {
    Bucket: string;
    Key: string;
  };
  NpmArgs: ReadonlyArray<string>;
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

      validateProperties(props);

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

      validateProperties(props);

      if (props.Package.Bucket === oldProps.Package.Bucket &&
        props.Package.Key === oldProps.Package.Key) {
        if (equalArrays(props.NpmArgs, oldProps.NpmArgs)) {
          return {
            PhysicalResourceId,
            Reason: `The lambda layer ${LogicalResourceId} has not been modified`,
          };
        }
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

function equalArrays<T>(lhs: readonly T[], rhs: readonly T[]) {
  return lhs.length === rhs.length && !lhs.some((arg, index) => arg !== rhs[index]);
}

function validateProperties(props: NodejsLayerVersionProperties) {
  if (!props.Package) {
    throw new Error('Package must be specified');
  }

  if (!props.Package.Bucket) {
    throw new Error('Package.Bucket must be specified');
  }

  if (!props.Package.Key) {
    throw new Error('Package.Key must be specified');
  }

  if (!props.NpmArgs || !props.NpmArgs.length) {
    throw new Error('NpmArgs must be specified');
  }
}

async function publishLayer(layerNme: string, props: NodejsLayerVersionProperties) {
  await rmdir(`${TMPDIR}/nodejs`, { recursive: true }).catch(_err => { });
  await mkdir(`${TMPDIR}/nodejs`, { recursive: true });

  const { Package, NpmArgs } = props;

  const s3 = new S3();

  const s3Url = `s3://${Package.Bucket}/${Package.Key}`;

  console.log(`Get S3 object ${s3Url}`);

  const packageS3Object = await s3.getObject(Package).promise();

  if (!packageS3Object.Body) {
    throw new Error(`The S3 object ${s3Url} must not be empty`);
  }

  console.log('Load as the zip filie');

  const packageZip = await JSZip.loadAsync(packageS3Object.Body as any);

  for (const filename of ['package.json', 'package-lock.json']) {
    console.log(`Extract ${filename}`);

    const packageJsonFile = packageZip.file(filename);
    if (!packageJsonFile) {
      throw new Error(`${filename} not found in the zip file`);
    }

    await writeFile(`${TMPDIR}/nodejs/${filename}`, await packageJsonFile.async('string'));
  }

  await spawnPromise('npm', NpmArgs, {
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
    ignore: ['nodejs/package.json', 'nodejs/package-lock.json'],
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

async function spawnPromise(cmd: string, args: readonly string[], options: SpawnOptions) {
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
