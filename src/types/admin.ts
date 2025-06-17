
export interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  newUsersThisMonth: number;
}

export interface RevenueData {
  month: string;
  revenue: number;
}

export interface UserSearchResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  planType: string;
  status: string;
  createdAt: string;
}

export interface Subscription {
  id: number;
  userName: string;
  email: string;
  plan: string;
  startDate: string;
  renewalDate: string;
  status: 'active' | 'expired' | 'cancelled';
  autoRenewal: boolean;
}

export interface PlanDistribution {
  name: string;
  value: number;
  color: string;
}
