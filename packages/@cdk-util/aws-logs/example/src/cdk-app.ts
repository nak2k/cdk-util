#!/usr/bin/env node
import { PreparedLogGroup } from "@cdk-util/aws-logs";
import { App, RemovalPolicy } from "aws-cdk-lib";
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { PreparedLogGroupExampleStack } from "./PreparedLogGroupExampleStack";

export const app = new App();

new PreparedLogGroupExampleStack(app, `PreparedLogGroupExampleStack`);

PreparedLogGroup.of(app).apply({
  removalPolicy: RemovalPolicy.DESTROY,
  retention: RetentionDays.FIVE_DAYS,
});
