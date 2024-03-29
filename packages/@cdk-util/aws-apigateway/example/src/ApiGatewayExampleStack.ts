import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";
import { DefaultEnvStack } from "@cdk-util/core";
import { RestApi, MockIntegration, PassthroughBehavior, EndpointType } from "aws-cdk-lib/aws-apigateway";
import { JSONMockIntegration, RedirectMockIntegration, RestApiBuilder, TextMockIntegration } from "@cdk-util/aws-apigateway";
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class ApiGatewayExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `@cdk-util/aws-apigateway Example`,
    });

    const bucket = new Bucket(this, "ExampleBucket", {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new BucketDeployment(this, "BucketDeployment", {
      sources: [Source.asset("./web")],
      destinationBucket: bucket,
      destinationKeyPrefix: "web",
    });

    const restApiRole = new Role(this, "Role", {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });

    bucket.grantReadWrite(restApiRole);

    const restApi = new RestApi(this, "Example", {
      restApiName: "ApiGatewayExample",
      endpointTypes: [EndpointType.REGIONAL],
      binaryMediaTypes: ["image/*"],
    });

    const mockIntegration = new MockIntegration({
      integrationResponses: [{
        statusCode: '200',
      }],
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{ "statusCode": 200 }',
      },
    });

    const textMockIntegration = new TextMockIntegration({ body: "Hello" });

    const jsonMockIntegration = new JSONMockIntegration({ body: { foo: "bar" } });

    const redirectMockIntegration = new RedirectMockIntegration({ location: "https://google.com" });

    const templateMockIntegration = new TextMockIntegration({
      responseTemplate: `{
    "stage" : "$context.stage",
    "request_id" : "$context.requestId",
    "api_id" : "$context.apiId",
    "resource_path" : "$context.resourcePath",
    "resource_id" : "$context.resourceId",
    "http_method" : "$context.httpMethod",
    "source_ip" : "$context.identity.sourceIp",
    "user-agent" : "$context.identity.userAgent",
    "account_id" : "$context.identity.accountId",
    "api_key" : "$context.identity.apiKey",
    "caller" : "$context.identity.caller",
    "user" : "$context.identity.user",
    "user_arn" : "$context.identity.userArn"
}`,
    });

    new RestApiBuilder({ restApi, defaultRole: restApiRole })
      .get([
        "/users/{userId}",
        "/users/{userId}/friends",
      ], mockIntegration, {
        methodResponses: [{ statusCode: '200' }],
      })
      .get("/",
        textMockIntegration,
        {
          methodResponses: textMockIntegration.methodResponses,
        }
      )
      .get("/json",
        jsonMockIntegration,
        {
          methodResponses: jsonMockIntegration.methodResponses,
        }
      )
      .get("/redirect",
        redirectMockIntegration,
        {
          methodResponses: redirectMockIntegration.methodResponses,
        }
      )
      .get("/test-template",
        templateMockIntegration,
        {
          methodResponses: templateMockIntegration.methodResponses,
        }
      )
      .get("/{proxy+}", mockIntegration, {
        methodResponses: [{ statusCode: '200' }],
      })
      .getS3Integration("/test/{dir}/{file}", { bucket })
      .putS3Integration("/test/{dir}/{file}", { bucket })
      .getS3Integration("/test2/{a}/{b}/{c}", { bucket, path: "/test3/{a}/{c}" })
      .getS3Integration("/web/{file}", { bucket })
      .getS3Integration("/web", {
        bucket,
        path: "/web/{file}",
        requestTemplates: {
          "application/json": '#set($context.requestOverride.path.file = "index.html")',
        },
      });
  }
}
