import { Construct, Duration } from "@aws-cdk/core";
import { Function, Code, Runtime } from "@aws-cdk/aws-lambda";
import { Rule } from "@aws-cdk/aws-events";
import { LambdaFunction } from "@aws-cdk/aws-events-targets";
import { PolicyStatement } from "@aws-cdk/aws-iam";

export interface EventsToSlackProps {
  webhookUrl: string;
  channel?: string;
  errorChannel?: string;
}

export class EventsToSlack extends Construct {
  constructor(scope: Construct, id: string, props: EventsToSlackProps) {
    super(scope, id);

    const handler = new Function(this, "handler", {
      code: Code.fromAsset(`${__dirname}/handler`),
      handler: "index.handler",
      runtime: Runtime.NODEJS_14_X,
      environment: {
        SLACK_WEBHOOK_URL: props.webhookUrl,
        SLACK_CHANNEL: props.channel ?? "",
        SLACK_ERROR_CHANNEL: props.errorChannel ?? "",
      },
      timeout: Duration.seconds(30),
      initialPolicy: [
        new PolicyStatement({
          actions: ["logs:GetLogEvents"],
          resources: ["*"],
        }),
      ],
    });

    new Rule(this, 'rule', {
      eventPattern: {
        source: [
          'aws.codebuild',
          'aws.codepipeline',
          'aws.glue',
          'aws.ssm',
        ],
        detailType: [
          'CodeBuild Build State Change',
          'CodePipeline Pipeline Execution State Change',
          'Glue Job State Change',
          'EC2 Command Invocation Status-change Notification',
        ],
      },
      targets: [
        new LambdaFunction(handler),
      ],
    });

  }
}
