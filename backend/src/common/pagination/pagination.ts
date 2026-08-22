import type { PaginationQueryDto } from './pagination-query.dto';

export function getPagination(query: PaginationQueryDto) {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  };
}

export function createPage<T>(
  data: T[],
  total: number,
  query: PaginationQueryDto,
) {
  return {
    data,
    meta: {
      limit: query.limit,
      page: query.page,
      pageCount: Math.ceil(total / query.limit),
      total,
    },
  };
}
