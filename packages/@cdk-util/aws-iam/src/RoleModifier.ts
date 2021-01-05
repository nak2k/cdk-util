import type { IAspect, IConstruct } from "@aws-cdk/core";
import { Role } from "@aws-cdk/aws-iam";

export class RoleModifier implements IAspect {
  constructor(private callback: (role: Role) => void) {
  }

  visit(node: IConstruct) {
    if (node instanceof Role) {
      this.callback(node);
    }
  }
}
