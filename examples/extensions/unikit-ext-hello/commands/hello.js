export function register(program) {
  program
    .command('hello')
    .description('Say hello from unikit-ext-hello extension')
    .option('--name <name>', 'Name to greet', 'World')
    .action((opts) => {
      console.log(`Hello, ${opts.name}! (from unikit-ext-hello extension)`);
    });
}
