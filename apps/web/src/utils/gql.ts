/**
 * 处理 GQL 语句，统一转换 profile 和 explain 语句
 * @param gql 原始 GQL 语句
 * @returns 处理后的 GQL 语句
 */
export function processGqlStatement(gql: string): string {
  if (!gql || typeof gql !== 'string') {
    return gql;
  }

  // 去除首尾空格
  const trimmedGql = gql.trim();

  if (!trimmedGql) {
    return trimmedGql;
  }

  // 创建正则表达式匹配各种情况
  // 1. profile 开头（可能带 format 参数）
  // 2. explain 开头
  const profileRegex = /^\s*profile\s*(?:format\s*=\s*["']?(verbose|default)["']?)?\s*/i;
  const explainRegex = /^\s*explain\s+/i;

  // 检查是否已经包含 profile 或 explain
  if (profileRegex.test(trimmedGql) || explainRegex.test(trimmedGql)) {
    // 如果已经包含 profile 或 explain，直接返回原始语句不做处理
    return trimmedGql;
  }

  // 如果没有以上述关键字开头，则自动添加 profile format="verbose"
  return `profile format="verbose" ${trimmedGql}`;
}
