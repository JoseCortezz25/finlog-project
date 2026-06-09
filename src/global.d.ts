declare module "*.css";
declare module "*.sql?raw" {
  const content: string;
  export default content;
}
