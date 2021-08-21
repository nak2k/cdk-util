import { MethodResponse, MockIntegration, PassthroughBehavior } from "@aws-cdk/aws-apigateway";
import { RestApiBuilder } from "./RestApiBuilder";

export interface TextMockIntegrationOptions {
  body: string;

  /**
   * The value of the content-type header.
   * 
   * @default text/plain
   */
  contentType?: string;
}

export class TextMockIntegration extends MockIntegration {
  methodResponses: MethodResponse[];

  constructor(options: TextMockIntegrationOptions) {
    const {
      body,
      contentType = "text/plain",
    } = options;

    const integrationResponses = [
      {
        statusCode: "200",
        responseTemplates: {
          "application/json": `#[[${body}]]#`,
        },
        responseParameters: {
          "method.response.header.Content-Type": `'${contentType}'`,
        },
      },
    ];

    super({
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{ "statusCode": 200 }',
      },
      integrationResponses,
    });

    this.methodResponses = RestApiBuilder.methodResponsesFrom(integrationResponses);
  }
}
