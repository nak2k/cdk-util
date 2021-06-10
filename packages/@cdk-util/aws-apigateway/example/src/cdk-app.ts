#!/usr/bin/env node
import { App } from "@aws-cdk/core";
import { ApiGatewayExampleStack } from "./ApiGatewayExampleStack";

export const app = new App();

new ApiGatewayExampleStack(app, `ApiGatewayExampleStack`);
