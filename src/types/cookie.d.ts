declare module "cookie" {
  export function parse(str: string): Record<string, string>;
  export function serialize(name: string, val: string, options?: any): string;
}
