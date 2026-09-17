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
  status?: 'ACTIVE' | 'COMPLETED';
  is_withdrawn?: boolean;
  withdrawn_amount?: number;
  withdrawn_at?: string;
  payout_tx_hash?: string;
  deposits: PersonalGoalDeposit[];
}

const STORAGE_KEY = 'rosco_personal_goals_store';

export function getPersonalGoals(userId?: string): PersonalGoal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    let all: PersonalGoal[] = JSON.parse(raw);
    let changed = false;

    // Healing migration:
    // If a goal had a withdrawal and current_amount is 0, or total deposits reached target with payout,
    // ensure is_completed and is_withdrawn stay true permanently.
    all = all.map(g => {
      const hasWithdrawal = (g.deposits || []).some(d => d.amount < 0);
      const totalDeposits = (g.deposits || []).reduce((sum, d) => d.amount > 0 ? sum + d.amount : sum, 0);

      if (g.is_withdrawn || (hasWithdrawal && g.current_amount <= 0) || (totalDeposits >= g.target_amount && hasWithdrawal)) {
        if (!g.is_completed || !g.is_withdrawn || g.status !== 'COMPLETED') {
          changed = true;
          return {
            ...g,
            is_completed: true,
            is_withdrawn: true,
            status: 'COMPLETED' as const,
          };
        }
      } else if (g.current_amount >= g.target_amount && !g.is_completed) {
        changed = true;
        return {
          ...g,
          is_completed: true,
          status: 'COMPLETED' as const,
        };
      }
      return g;
    });

    if (changed) {
      savePersonalGoals(all);
    }

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

  const isCompleted = initial >= data.target_amount;
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
    is_completed: isCompleted,
    status: isCompleted ? 'COMPLETED' : 'ACTIVE',
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
    goal.status = 'COMPLETED';
  }

  savePersonalGoals(goals);
  return goal;
}

export interface WithdrawalReceipt {
  requestedAmount: number;
  feePercent: number;
  feeAmount: number;
  netPayoutAmount: number;
  isEarlyExit: boolean;
  txHash?: string;
  goal: PersonalGoal;
}

export function withdrawFromPersonalGoal(
  goalId: string, 
  amount?: number, 
  txHash?: string
): WithdrawalReceipt {
  const goals = getPersonalGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) {
    throw new Error('Personal goal not found');
  }

  const withdrawAmount = amount !== undefined ? Math.min(amount, goal.current_amount) : goal.current_amount;
  // A goal is completed if it was marked completed or if current_amount reached target
  const wasAlreadyCompleted = goal.is_completed || goal.is_withdrawn || (goal.current_amount >= goal.target_amount);
  const isEarlyExit = !wasAlreadyCompleted;
  const feePercent = isEarlyExit ? 10 : 0;
  const feeAmount = isEarlyExit ? Math.round(withdrawAmount * 0.10 * 100) / 100 : 0;
  const netPayoutAmount = Math.max(0, Math.round((withdrawAmount - feeAmount) * 100) / 100);

  goal.current_amount = Math.max(0, Math.round((goal.current_amount - withdrawAmount) * 100) / 100);
  
  if (wasAlreadyCompleted) {
    // Goal reached target! Maintain completed status permanently!
    goal.is_completed = true;
    goal.status = 'COMPLETED';
    goal.is_withdrawn = true;
    goal.withdrawn_amount = (goal.withdrawn_amount || 0) + withdrawAmount;
    goal.withdrawn_at = new Date().toISOString();
    if (txHash) {
      goal.payout_tx_hash = txHash;
    }
  } else {
    // Early exit before reaching target
    if (goal.current_amount <= 0) {
      // Entire balance withdrawn early: mark as withdrawn so it moves to Completed/Closed section
      goal.is_withdrawn = true;
      goal.is_completed = false;
      goal.status = 'COMPLETED';
      goal.withdrawn_amount = (goal.withdrawn_amount || 0) + withdrawAmount;
      goal.withdrawn_at = new Date().toISOString();
      if (txHash) {
        goal.payout_tx_hash = txHash;
      }
    } else {
      // Partial early withdrawal: user still has savings in the goal
      goal.is_completed = false;
      goal.status = 'ACTIVE';
    }
  }

  goal.deposits.unshift({
    id: `wdr_${Date.now()}`,
    amount: -withdrawAmount,
    date: new Date().toISOString(),
    tx_hash: txHash,
    note: isEarlyExit 
      ? `Early withdrawal (-${feePercent}% fee: ${feeAmount} NIM, net: ${netPayoutAmount} NIM)`
      : `Target achieved withdrawal (100% payout: ${netPayoutAmount} NIM)`,
  });

  savePersonalGoals(goals);
  return {
    requestedAmount: withdrawAmount,
    feePercent,
    feeAmount,
    netPayoutAmount,
    isEarlyExit,
    txHash,
    goal,
  };
}

export function deletePersonalGoal(goalId: string): void {
  const goals = getPersonalGoals();
  const filtered = goals.filter(g => g.id !== goalId);
  savePersonalGoals(filtered);
}
