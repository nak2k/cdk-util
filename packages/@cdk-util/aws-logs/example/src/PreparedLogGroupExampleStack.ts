import { Construct } from "@aws-cdk/core";
import { DefaultEnvStack } from "@cdk-util/core";
import { Code, Function, Runtime } from "@aws-cdk/aws-lambda";

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
