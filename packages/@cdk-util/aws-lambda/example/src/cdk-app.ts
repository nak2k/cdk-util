#!/usr/bin/env node
import { App } from "@aws-cdk/core";
import { NodejsLayerExampleStack } from "./NodejsLayerExampleStack";

export const app = new App();

new NodejsLayerExampleStack(app, `NodejsLayerExampleStack`);
