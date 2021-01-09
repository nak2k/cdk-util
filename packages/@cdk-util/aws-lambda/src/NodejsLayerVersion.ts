import { ILayerVersion, LayerVersion } from '@aws-cdk/aws-lambda';
import { Asset } from '@aws-cdk/aws-s3-assets';
import { Construct, CustomResource, CustomResourceProvider, CustomResourceProviderRuntime, Size } from '@aws-cdk/core';
import { join } from 'path';
import { createDirSync } from 'mktemp';
import { copyFileSync } from 'fs';
import { tmpdir } from 'os';

export interface NodejsLayerVersionProps {
  /**
   * The path of the directory that contains package.json and package-lock.json.
   */
  packageDirectory: string;

  /**
   * The boolean value whether use package-lock.json instead of package.json.
   */
  useLockFile?: boolean;

  /**
   * Arguments that pass to npm.
   * 
   * Default: if useLockFile enabled, ['ci', '--production'], otherwise ['install', '--production'].
   */
  npmArgs?: ReadonlyArray<string>;

  /**
   * The boolean value whether only the custom resource provider is deployed for debugging.
   */
  providerOnly?: boolean;
}

export class NodejsLayerVersion extends Construct {
  public static readonly resourceType = 'Custom::NodejsLayerVersion';

  private _layerVersion: ILayerVersion;

  public get layerVersion(): ILayerVersion {
    if (this.props.providerOnly) {
      throw new Error('The providerOnly option is enabled, so LayerVersion is not created');
    }

    return this._layerVersion;
  }

  constructor(scope: Construct, id: string, private props: NodejsLayerVersionProps) {
    super(scope, id);

    const { packageDirectory, useLockFile, npmArgs, providerOnly } = props;

    const tmpDir = createDirSync(join(tmpdir(), 'cdk-util-aws-lambda-XXXXXXXX'));

    copyFileSync(join(packageDirectory, 'package.json'), join(tmpDir, 'package.json'));
    copyFileSync(join(packageDirectory, 'package-lock.json'), join(tmpDir, 'package-lock.json'));

    const asset = new Asset(this, 'Asset', {
      path: tmpDir,
    });

    const serviceToken = CustomResourceProvider.getOrCreate(scope, NodejsLayerVersion.resourceType, {
      codeDirectory: join(__dirname, 'nodejslayer-handler'),
      runtime: CustomResourceProviderRuntime.NODEJS_12,
      memorySize: Size.mebibytes(512),
      policyStatements: [
        {
          Effect: 'Allow',
          Action: ['s3:GetObject*', 's3:PutObject*'],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: [
            'lambda:DeleteLayerVersion',
            'lambda:ListLayerVersions',
            'lambda:PublishLayerVersion',
          ],
          Resource: '*',
        },
      ],
    });

    if (providerOnly) {
      return;
    }

    const resource = new CustomResource(this, 'CustomResource', {
      resourceType: NodejsLayerVersion.resourceType,
      serviceToken,
      properties: {
        Package: {
          Bucket: asset.s3BucketName,
          Key: asset.s3ObjectKey,
        },
        NpmArgs: npmArgs || (
          useLockFile ? ['ci', '--production'] : ['install', '--production']
        ),
      },
    });

    this._layerVersion = LayerVersion.fromLayerVersionArn(this, 'LayerVersion', resource.ref);
  }
}
