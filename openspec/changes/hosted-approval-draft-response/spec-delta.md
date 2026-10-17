# Draft ownership requirement

An asynchronous approval response owns only its submitted form snapshot. If any later edit/source load changes that ownership, success cannot clear or replace the newer draft or move its selection. It must still display the original durable approval and an accurate preserved-draft status.

A controlled hold starts only after the shipped Worker has durably committed the actual D1 approval and buffered its response. Desktop/mobile regression cases edit text/citation/selection before releasing it. They require the original approval, preserved newer controls/selection, meaningful status and zero GitHub proposals. Each browser case uses its own synthetic D1 state; production quotas remain unchanged.
