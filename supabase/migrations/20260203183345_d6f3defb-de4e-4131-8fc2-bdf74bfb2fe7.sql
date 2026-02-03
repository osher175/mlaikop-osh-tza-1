-- Add 'purchase' to allowed action types in inventory_actions
ALTER TABLE inventory_actions 
DROP CONSTRAINT IF EXISTS inventory_actions_action_type_check;

ALTER TABLE inventory_actions 
ADD CONSTRAINT inventory_actions_action_type_check 
CHECK (action_type = ANY (ARRAY[
  'add'::text, 
  'remove'::text, 
  'adjust'::text, 
  'sale'::text, 
  'return'::text,
  'purchase'::text
]));