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
        StackId,
        LogicalResourceId,
        ResourceProperties,
      } = event;

      const props = ResourceProperties as NodejsLayerVersionProperties;

      validateProperties(props);

      const [, stackName] = StackId.split('/');
      const layerName = `${stackName}-${LogicalResourceId}`;

      const layerVersion = await publishLayer(layerName, props);

      return {
        PhysicalResourceId: layerVersion.LayerVersionArn!,
        Reason: `The lambda layer ${layerName} has been created`,
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

      const [, , , , , , LayerName] = PhysicalResourceId.split(':');

      if (props.Package.Bucket === oldProps.Package.Bucket &&
        props.Package.Key === oldProps.Package.Key) {
        if (equalArrays(props.NpmArgs, oldProps.NpmArgs)) {
          return {
            PhysicalResourceId,
            Reason: `The lambda layer ${LayerName} has not been modified`,
          };
        }
      }

      const layerVersion = await publishLayer(LayerName, props);

      return {
        PhysicalResourceId: layerVersion.LayerVersionArn!,
        Reason: `The lambda layer ${LayerName} has been updated`,
      };
    }

    case 'Delete': {
      const {
        PhysicalResourceId,
      } = event;

      const lambda = new Lambda();

      const [, , , , , , LayerName, VersionNumber] = PhysicalResourceId.split(':');

      await lambda.deleteLayerVersion({
        LayerName,
        VersionNumber: parseInt(VersionNumber, 10),
      }).promise();

      return {
        Reason: `The lambda layer ${PhysicalResourceId} has been deleted`,
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

async function publishLayer(layerName: string, props: NodejsLayerVersionProperties) {
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

  //
  // Read package.json.
  //
  console.log(`Extract package.json`);

  const packageJsonFile = packageZip.file('package.json');
  if (!packageJsonFile) {
    throw new Error(`package.json not found in the zip file`);
  }

  const packageJsonStr = await packageJsonFile.async('string');
  await writeFile(`${TMPDIR}/nodejs/package.json`, packageJsonStr);

  let packageJson;

  try {
    packageJson = JSON.parse(packageJsonStr);
  } catch (err) {
    throw new Error(`The package.json is invalid JSON. ${err.message}`);
  }

  //
  // Read package-lock.json.
  //
  console.log(`Extract package-lock.json`);

  const packageLockJsonFile = packageZip.file('package-lock.json');
  if (!packageLockJsonFile) {
    throw new Error(`package-lock.json not found in the zip file`);
  }

  await writeFile(`${TMPDIR}/nodejs/package-lock.json`, await packageLockJsonFile.async('string'));

  //
  // Run npm.
  //
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

  console.log(`Publish the layer version ${layerName}`);

  const lambda = new Lambda();

  return lambda.publishLayerVersion({
    LayerName: layerName,
    Description: packageJson.name,
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
