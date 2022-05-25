#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { NodejsFunctionExampleStack } from "./NodejsFunctionExampleStack";
import { NodejsLayerExampleStack } from "./NodejsLayerExampleStack";

export const app = new App();

new NodejsFunctionExampleStack(app, `NodejsFunctionExampleStack`);
new NodejsLayerExampleStack(app, `NodejsLayerExampleStack`);
