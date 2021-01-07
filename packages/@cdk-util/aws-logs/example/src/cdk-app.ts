#!/usr/bin/env node
import { App, RemovalPolicy } from "@aws-cdk/core";
import { PreparedLogGroupExampleStack } from "./PreparedLogGroupExampleStack";
import { PreparedLogGroup } from "@cdk-util/aws-logs";
import { RetentionDays } from '@aws-cdk/aws-logs';

export const app = new App();

new PreparedLogGroupExampleStack(app, `PreparedLogGroupExampleStack`);

PreparedLogGroup.of(app).apply({
  removalPolicy: RemovalPolicy.DESTROY,
  retention: RetentionDays.FIVE_DAYS,
});
