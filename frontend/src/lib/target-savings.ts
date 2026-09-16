/**
 * Target Savings (Personal Vault) Service for Rosco
 * 
 * Allows users to create personal savings goals, track progress,
 * deposit funds directly via Nimiq Pay or record contributions,
 * and withdraw or complete their goals independently.
 */

export interface PersonalGoalDeposit {
  id: string;
  amount: number;
  date: string;
  tx_hash?: string;
  note?: string;
}

export interface PersonalGoal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  category: 'Tech' | 'Emergency' | 'Travel' | 'Rent' | 'Education' | 'General';
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Flexible';
  target_date?: string;
  created_at: string;
  is_completed: boolean;
  deposits: PersonalGoalDeposit[];
}

const STORAGE_KEY = 'rosco_personal_goals_store';

export function getPersonalGoals(userId?: string): PersonalGoal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: PersonalGoal[] = JSON.parse(raw);
    if (userId) {
      return all.filter(g => g.user_id.toLowerCase() === userId.toLowerCase());
    }
    return all;
  } catch (err) {
    console.warn('[Rosco] Failed to read personal goals:', err);
    return [];
  }
}

export function savePersonalGoals(goals: PersonalGoal[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch (err) {
    console.warn('[Rosco] Failed to save personal goals:', err);
  }
}

export function createPersonalGoal(data: {
  user_id: string;
  title: string;
  target_amount: number;
  initial_deposit?: number;
  category: 'Tech' | 'Emergency' | 'Travel' | 'Rent' | 'Education' | 'General';
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Flexible';
  target_date?: string;
  tx_hash?: string;
}): PersonalGoal {
  const initial = data.initial_deposit && data.initial_deposit > 0 ? data.initial_deposit : 0;
  const deposits: PersonalGoalDeposit[] = [];
  
  if (initial > 0) {
    deposits.push({
      id: `dep_${Date.now()}_init`,
      amount: initial,
      date: new Date().toISOString(),
      tx_hash: data.tx_hash,
      note: 'Initial deposit',
    });
  }

  const newGoal: PersonalGoal = {
    id: `goal_${Date.now()}`,
    user_id: data.user_id,
    title: data.title.trim(),
    target_amount: data.target_amount,
    current_amount: initial,
    category: data.category || 'General',
    frequency: data.frequency || 'Weekly',
    target_date: data.target_date,
    created_at: new Date().toISOString(),
    is_completed: initial >= data.target_amount,
    deposits,
  };

  const existing = getPersonalGoals();
  existing.unshift(newGoal);
  savePersonalGoals(existing);
  return newGoal;
}

export function depositToPersonalGoal(
  goalId: string,
  amount: number,
  txHash?: string,
  note?: string
): PersonalGoal {
  const goals = getPersonalGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) {
    throw new Error('Personal goal not found');
  }

  const deposit: PersonalGoalDeposit = {
    id: `dep_${Date.now()}`,
    amount,
    date: new Date().toISOString(),
    tx_hash: txHash,
    note: note || 'Target contribution',
  };

  goal.deposits.unshift(deposit);
  goal.current_amount = Math.round((goal.current_amount + amount) * 100) / 100;
  if (goal.current_amount >= goal.target_amount) {
    goal.is_completed = true;
  }

  savePersonalGoals(goals);
  return goal;
}

export function withdrawFromPersonalGoal(goalId: string, amount?: number): PersonalGoal {
  const goals = getPersonalGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) {
    throw new Error('Personal goal not found');
  }

  const withdrawAmount = amount !== undefined ? amount : goal.current_amount;
  goal.current_amount = Math.max(0, Math.round((goal.current_amount - withdrawAmount) * 100) / 100);
  if (goal.current_amount < goal.target_amount) {
    goal.is_completed = false;
  }

  goal.deposits.unshift({
    id: `wdr_${Date.now()}`,
    amount: -withdrawAmount,
    date: new Date().toISOString(),
    note: 'Withdrawal from vault',
  });

  savePersonalGoals(goals);
  return goal;
}

export function deletePersonalGoal(goalId: string): void {
  const goals = getPersonalGoals();
  const filtered = goals.filter(g => g.id !== goalId);
  savePersonalGoals(filtered);
}
