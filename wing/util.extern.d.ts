export default interface extern {
  setEnv: (env: Readonly<Record<string, string>>) => Promise<void>,
}
