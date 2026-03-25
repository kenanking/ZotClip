import { config } from "../../package.json";
import { FluentMessageId } from "../../typings/i10n";

export { initLocale, getString };

interface GetStringOptions {
  branch?: string | undefined;
  args?: Record<string, unknown>;
}

/**
 * Initialize locale data
 */
function initLocale() {
  const l10n = new (
    typeof Localization === "undefined"
      ? ztoolkit.getGlobal("Localization")
      : Localization
  )([`${config.addonRef}-addon.ftl`], true);
  addon.data.locale = {
    current: l10n,
  };
}

/**
 * Get locale string, see https://firefox-source-docs.mozilla.org/l10n/fluent/tutorial.html#fluent-translation-list-ftl
 * @param localString ftl key
 * @param options.branch branch name
 * @param options.args args
 * @example
 * ```ftl
 * # addon.ftl
 * addon-static-example = This is default branch!
 *     .branch-example = This is a branch under addon-static-example!
 * addon-dynamic-example =
    { $count ->
        [one] I have { $count } apple
       *[other] I have { $count } apples
    }
 * ```
 * ```js
 * getString("addon-static-example"); // This is default branch!
 * getString("addon-static-example", { branch: "branch-example" }); // This is a branch under addon-static-example!
 * getString("addon-dynamic-example", { args: { count: 1 } }); // I have 1 apple
 * getString("addon-dynamic-example", { args: { count: 2 } }); // I have 2 apples
 * ```
 */
function getString(localString: FluentMessageId): string;
function getString(localString: FluentMessageId, branch: string): string;
function getString(
  localeString: FluentMessageId,
  options: GetStringOptions,
): string;
function getString(
  localeString: FluentMessageId,
  branchOrOptions?: string | GetStringOptions,
): string {
  if (typeof branchOrOptions === "string") {
    return _getString(localeString, { branch: branchOrOptions });
  }

  return _getString(localeString, branchOrOptions);
}

interface Pattern {
  value: string | null;
  attributes: Array<{
    name: string;
    value: string;
  }> | null;
}

function _getString(
  localeString: FluentMessageId,
  options: GetStringOptions = {},
): string {
  const localStringWithPrefix = `${config.addonRef}-${localeString}`;
  const { branch, args } = options;
  const pattern = addon.data.locale?.current.formatMessagesSync([
    { id: localStringWithPrefix, args },
  ])[0] as Pattern;

  if (!pattern) {
    return localStringWithPrefix;
  }
  if (branch && pattern.attributes) {
    return (
      pattern.attributes.find((attr) => attr.name === branch)?.value ||
      localStringWithPrefix
    );
  } else {
    return pattern.value || localStringWithPrefix;
  }
}
