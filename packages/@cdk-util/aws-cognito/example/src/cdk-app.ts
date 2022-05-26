#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { CognitoExampleStack } from "./CognitoExampleStack";

export const app = new App();

new CognitoExampleStack(app, `CognitoExampleStack`);
