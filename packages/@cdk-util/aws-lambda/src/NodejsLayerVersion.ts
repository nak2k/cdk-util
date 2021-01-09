import { ILayerVersion, LayerVersion } from '@aws-cdk/aws-lambda';
import { Asset } from '@aws-cdk/aws-s3-assets';
import { Construct, CustomResource, CustomResourceProvider, CustomResourceProviderRuntime, Size, Token } from '@aws-cdk/core';
import { join } from 'path';

export interface NodejsLayerVersionProps {
  codeDirectory: string;

  /**
   * The boolean value whether use package-lock.json instead of package.json.
   */
  useLockFile: boolean;

  /**
   * The boolean value whether only the custom resource provider is deployed for debugging.
   */
  providerOnly?: boolean;
}

export class NodejsLayerVersion extends Construct {
  public static readonly resourceType = 'Custom::NodejsLayerVersion';

  public readonly layerVersion: ILayerVersion;

  constructor(scope: Construct, id: string, props: NodejsLayerVersionProps) {
    super(scope, id);

    const { codeDirectory, useLockFile, providerOnly } = props;

    const asset = new Asset(this, 'Asset', {
      path: join(codeDirectory, useLockFile ? 'package-lock.json' : 'package.json'),
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
        [useLockFile ? 'PackageLock' : 'Package']: {
          Bucket: asset.s3BucketName,
          Key: asset.s3ObjectKey,
        },
      },
    });

    this.layerVersion = LayerVersion.fromLayerVersionArn(this, 'LayerVersion', resource.ref);
  }
}
