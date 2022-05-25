import { Construct } from "constructs";
import { NodejsLayerVersion } from "@cdk-util/aws-lambda";
import { DefaultEnvStack } from "@cdk-util/core";
import {
  Code,
  Function,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { SymlinkFollowMode } from "aws-cdk-lib";

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
      packageDirectory: lambdaPath,
      useLockFile: true,
      providerOnly,
    });

    if (providerOnly) {
      return;
    }

    //
    // Create the Lambda function.
    //
    new Function(this, "Function", {
      runtime: Runtime.NODEJS_16_X,
      code: Code.fromAsset(lambdaPath, {
        exclude: ["package*.json", "node_modules", "tsconfig.json"],
        followSymlinks: SymlinkFollowMode.ALWAYS,
      }),
      handler: "index.handler",
      layers: [layer.layerVersion],
    });
  }
}
