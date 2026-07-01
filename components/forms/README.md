# components/forms

Reusable, presentational form building blocks (shadcn + react-hook-form + zod),
e.g. labelled fields, sectioned layouts, the Save/Cancel action bar (06 §9).

No business logic and no data access — forms submit to `server/actions`, which
validate (zod) and delegate to `server/services` (09 §2, §4).

_Empty in the foundation (Steps 1-2); populated from Step 6 (patient registration)._
