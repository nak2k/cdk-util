import { Construct, RemovalPolicy } from "@aws-cdk/core";
import { DefaultEnvStack } from "@cdk-util/core";
import { RestApi, MockIntegration, PassthroughBehavior, EndpointType } from "@aws-cdk/aws-apigateway";
import { RestApiBuilder } from "@cdk-util/aws-apigateway";
import { Bucket } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from "@aws-cdk/aws-s3-deployment";
import { Role, ServicePrincipal } from '@aws-cdk/aws-iam';

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

    new RestApiBuilder({ restApi, defaultRole: restApiRole })
      .get([
        "/users/{userId}",
        "/users/{userId}/friends",
      ], mockIntegration, {
        methodResponses: [{ statusCode: '200' }],
      })
      .any("/", mockIntegration)
      .get("/{proxy+}", mockIntegration)
      .getS3Integration("/test/{dir}/{file}", { bucket })
      .putS3Integration("/test/{dir}/{file}", { bucket })
      .getS3Integration("/test2/{a}/{b}/{c}", { bucket, path: "/test3/{a}/{c}" })
      .getS3Integration("/web/{file}", { bucket });
  }
}
