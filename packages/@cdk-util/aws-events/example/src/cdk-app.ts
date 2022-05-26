#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { EventsToSlackExampleStack } from "./EventsToSlackExampleStack";

export const app = new App();

new EventsToSlackExampleStack(app, `EventsToSlackExampleStack`);
