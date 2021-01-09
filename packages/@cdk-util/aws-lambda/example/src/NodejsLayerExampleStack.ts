import { Construct } from "@aws-cdk/core";
import { NodejsLayerVersion } from "@cdk-util/aws-lambda";
import { DefaultEnvStack } from "@cdk-util/core";
import {
  Code,
  Function,
  Runtime,
} from "@aws-cdk/aws-lambda";
import { FollowMode } from "@aws-cdk/assets";

export class NodejsLayerExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `NodeJS Layer Example`,
    });

    const lambdaPath = "./lambda";

    //
    // Create the LayerVersion.
    //
    const providerOnly = false;
    const layer = new NodejsLayerVersion(this, "LayerVersion", {
      codeDirectory: lambdaPath,
      useLockFile: false,
      providerOnly,
    });

    if (providerOnly) {
      return;
    }

    //
    // Create the Lambda function.
    //
    new Function(this, "Function", {
      runtime: Runtime.NODEJS_12_X,
      code: Code.fromAsset(lambdaPath, {
        exclude: ["package*.json", "node_modules", "tsconfig.json"],
        follow: FollowMode.ALWAYS,
      }),
      handler: "index.handler",
      layers: [layer.layerVersion],
    });
  }
}
