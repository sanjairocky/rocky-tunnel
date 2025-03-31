require("dotenv").config({ path: process.env.ENV_FILE || ".env" });

const { Command } = require("commander");
const program = new Command();

program
  .name("rocky-tunnel")
  .description("Rocky tunnel built to expose localhost")
  .version("1.0.0");

program
  .command("master")
  .description("Serve as master ( Should be deployed in public cloud )")
  .action((name) => {
    require("./master");
  });

program
  .command("agent")
  .description("Serve as agent which connects to master node from anywhere")
  .action((name) => {
    require("./agent");
  });

program
  .command("cluster")
  .description("local testing both master & agent")
  .action((name) => {
    require("./master");
    require("./agent");
  });

program.parse(process.argv);
