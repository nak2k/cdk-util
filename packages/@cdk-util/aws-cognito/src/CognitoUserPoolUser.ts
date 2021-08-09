import { Construct, CustomResource, Duration, Stack } from '@aws-cdk/core';
import { Code, Function, Runtime } from '@aws-cdk/aws-lambda';
import { join } from 'path';
import { PolicyStatement } from '@aws-cdk/aws-iam';
import { UserPool } from '@aws-cdk/aws-cognito';
import { StringParameter, ParameterType } from '@aws-cdk/aws-ssm';
import { Secret } from '@aws-cdk/aws-secretsmanager';

export type CognitoUserPoolUserProps = {
  userPool: UserPool;

  username: string;

  /**
     * The desired length of the generated password.
     *
     * @default 32
   */
  passwordLength?: number;

  /**
   * The boolean value whether only the custom resource provider is deployed for debugging.
   */
  providerOnly?: boolean;
} & (
    | {
      /**
       * The password is not stored.
       * 
       * The password is generated by Cognito User Pool.
       */
      passwordStore: "none";
    }
    | {
      /**
       * The password is stored in Secret Manager.
       *
       * The password is generated by Secret Manager.
       */
      passwordStore: "secretsmanager";
    }
    | {
      /**
       * The password is stored as String not Secure String in Systems Manager Parameter Store.
       * 
       * This is not secure method, but no charge, so useful for demonstration and testing.
       *
       * The password is generated by Secret Manager.
       */
      passwordStore: "ssm";

      passwordParameterName: string;
    }
  );

export class CognitoUserPoolUser extends Construct {
  public static readonly resourceType = 'Custom::CognitoUserPoolUser';

  readonly secret: Secret;

  readonly passwordParameter: StringParameter;

  constructor(scope: Construct, id: string, props: CognitoUserPoolUserProps) {
    super(scope, id);

    const {
      userPool,
      username,
      passwordLength,
      providerOnly,
    } = props;

    const match = username.match(/[^\p{L}\p{M}\p{S}\p{N}\p{P}]/u);
    if (match) {
      throw new Error(`The username has prohibited characters ${match}`);
    }

    if (props.passwordStore === "secretsmanager") {
      this.secret = new Secret(this, "secret", {
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ username }),
          generateStringKey: "password",
          excludeCharacters: "+-=",
          passwordLength,
        },
      });
    } else if (props.passwordStore === "ssm") {
      this.passwordParameter = new StringParameter(this, "passwordParameter", {
        parameterName: props.passwordParameterName,
        stringValue: "--place-holder--",
        type: ParameterType.STRING,
      });
    }

    const serviceToken = this.createProvider(scope);

    if (providerOnly) {
      return;
    }

    new CustomResource(this, 'CustomResource', {
      resourceType: CognitoUserPoolUser.resourceType,
      serviceToken,
      properties: {
        UserPoolId: userPool.userPoolId,
        Username: username,
        PasswordLength: passwordLength,
        SecretId: this.secret?.secretArn,
        PasswordParameterName: this.passwordParameter?.parameterName,
      },
    });
  }

  private createProvider(scope: Construct) {
    const providerId = `${CognitoUserPoolUser.resourceType}Provider`;
    const stack = Stack.of(scope);

    const provider = stack.node.tryFindChild(providerId) as Function
      ?? new Function(stack, providerId, {
        code: Code.fromAsset(join(__dirname, 'cognitouserpooluser-handler')),
        runtime: Runtime.NODEJS_14_X,
        handler: "index.handler",
        initialPolicy: [
          new PolicyStatement({
            actions: [
              'cognito-idp:AdminCreateUser',
              'cognito-idp:AdminDeleteUser',
              'cognito-idp:AdminSetUserPassword',
              'secretsmanager:GetSecretValue',
              'secretsmanager:GetRandomPassword',
              'ssm:PutParameter',
            ],
            resources: ['*'],
          }),
        ],
        timeout: Duration.minutes(5),
        retryAttempts: 1,
      });

    return provider.functionArn;
  }
}
