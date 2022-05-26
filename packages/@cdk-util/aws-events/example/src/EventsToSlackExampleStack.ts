import { EventsToSlack } from "@cdk-util/aws-events";
import { DefaultEnvStack } from "@cdk-util/core";
import { Construct } from "constructs";

export class EventsToSlackExampleStack extends DefaultEnvStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `@cdk-util/aws-events Example`,
    });

    new EventsToSlack(this, "eventsToSlack", {
      webhookUrl: "",
    });
  }
}
