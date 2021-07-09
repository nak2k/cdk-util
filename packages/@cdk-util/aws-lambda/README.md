# @cdk-util/aws-lambda

## Installation

```
npm i @cdk-util/aws-lambda
```

## Usage

``` typescript
import { NodejsFunction } from "@cdk-util/aws-lambda";

/**
 * Defines a Lambda Function and a Lambda Layer for NodeJS.
 * 
 * This construct requires package.json in a specified directory
 * to generate the Function and the Layer.
 * 
 * The directory pointed by the `main` property of the package.json
 * is used for the code asset of the Function.
 * 
 * The `dependencies` property is used to generate the Layer with CodeBuild.
 */
const handler = new NodejsFunction(this, "handler", {
  packageDirectory: 'path/to/dir',
});
```

## License

MIT
