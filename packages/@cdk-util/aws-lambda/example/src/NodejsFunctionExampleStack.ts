import { Construct } from "@aws-cdk/core";
import { NodejsFunction } from "@cdk-util/aws-lambda";
import { DefaultEnvStack } from "@cdk-util/core";

export class NodejsFunctionExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `NodeJS Function Example`,
    });

    new NodejsFunction(this, "Function", {
      packageDirectory: './lambda',
    });
  }
}
