import { Construct } from "@aws-cdk/core";
import { DefaultEnvStack } from "@cdk-util/core";
import { EventsToSlack } from "@cdk-util/aws-events";

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
