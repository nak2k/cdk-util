import { DefaultEnvStack } from "@cdk-util/core";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export class PreparedLogGroupExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `PreparedLogGroup Example`,
    });

    new Function(this, 'Function', {
      code: Code.fromAsset(__dirname + '/handler'),
      handler: 'index.handler',
      runtime: Runtime.NODEJS_14_X,
    });
  }
}
