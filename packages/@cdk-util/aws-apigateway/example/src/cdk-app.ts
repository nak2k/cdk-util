#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { ApiGatewayExampleStack } from "./ApiGatewayExampleStack";

export const app = new App();

new ApiGatewayExampleStack(app, `ApiGatewayExampleStack`);
