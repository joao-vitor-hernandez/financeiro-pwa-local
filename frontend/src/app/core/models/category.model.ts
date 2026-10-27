export type CategoryType = 'INCOME' | 'EXPENSE';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
  parent_id?: string | null;
  is_active: boolean;
  subcategories: Category[];
}

export interface CategoryCreate {
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
  parent_id?: string | null;
}
