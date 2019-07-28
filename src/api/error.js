export default async function init_error(api) {
  return {
    exit_error(text) {
      api.setError(text);
    },
  };
}
