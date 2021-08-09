import { Construct, RemovalPolicy } from "@aws-cdk/core";
import { DefaultEnvStack } from "@cdk-util/core";
import { UserPool } from "@aws-cdk/aws-cognito";
import { CognitoUserPoolUser } from "@cdk-util/aws-cognito";

export class CognitoExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `@cdk-util/aws-cognito Example`,
    });

    const userPool = new UserPool(this, 'userPool', {
      userPoolName: 'example',
      signInAliases: {
        username: true,
        email: true,
        phone: false,
        preferredUsername: true,
      },
      autoVerify: {
        email: true,
        phone: false,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new CognitoUserPoolUser(this, 'cognitoUser', {
      userPool,
      username: "test",
      passwordStore: "ssm",
      passwordParameterName: "/CognitoExampleStack/cognitoUserPassword",
      providerOnly: false,
    });
  }
}
