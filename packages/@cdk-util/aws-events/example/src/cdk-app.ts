#!/usr/bin/env node
import { App } from "@aws-cdk/core";
import { EventsToSlackExampleStack } from "./EventsToSlackExampleStack";

export const app = new App();

new EventsToSlackExampleStack(app, `EventsToSlackExampleStack`);
