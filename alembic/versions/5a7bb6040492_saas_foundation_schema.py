"""saas_foundation_schema
Revision ID: 5a7bb6040492
Revises:
Create Date: 2026-05-26 14:53:20.855768
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '5a7bb6040492'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:

    op.create_table('organizations',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), unique=True, nullable=False, index=True),
        sa.Column('plan', sa.String(), default='free'),
        sa.Column('stripe_customer_id', sa.String(), unique=True, nullable=True),
        sa.Column('stripe_subscription_id', sa.String(), nullable=True),
        sa.Column('stripe_subscription_status', sa.String(), nullable=True),
        sa.Column('trial_ends_at', sa.DateTime(), nullable=True),
        sa.Column('scans_this_month', sa.Integer(), default=0),
        sa.Column('quota_reset_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
    )

    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('email', sa.String(), unique=True, nullable=False, index=True),
        sa.Column('hashed_password', sa.String(), nullable=True),
        sa.Column('github_id', sa.String(), unique=True, nullable=True),
        sa.Column('email_verified', sa.Boolean(), default=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('last_login_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table('organization_members',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.String(), default='member'),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('org_id', 'user_id'),
    )

    op.create_table('invitations',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('invited_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('token', sa.String(), unique=True, nullable=False, index=True),
        sa.Column('role', sa.String(), default='member'),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table('sessions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('refresh_token_hash', sa.String(), unique=True, nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table('api_keys',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('key_hash', sa.String(), unique=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
    )

    op.create_table('user_repos',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('repo_name', sa.String(), nullable=False),
        sa.Column('repo_url', sa.String(), nullable=True),
        sa.Column('added_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
    )

    op.create_table('stripe_events',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('stripe_event_id', sa.String(), unique=True, nullable=False, index=True),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
    )

    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource', sa.String(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table('scan_results',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('scanned_at', sa.DateTime(), nullable=True),
        sa.Column('repo', sa.String(), index=True),
        sa.Column('secrets_found', sa.Integer(), default=0),
        sa.Column('vulns_found', sa.Integer(), default=0),
        sa.Column('critical_count', sa.Integer(), default=0),
        sa.Column('brain_winner', sa.String(), nullable=True),
        sa.Column('brain_score', sa.Float(), nullable=True),
        sa.Column('tokens_used', sa.Integer(), default=0),
        sa.Column('analysis', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), default='complete'),
    )

    op.create_table('remediation_actions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('actioned_at', sa.DateTime(), nullable=True),
        sa.Column('repo', sa.String(), index=True),
        sa.Column('action', sa.String(), nullable=True),
        sa.Column('approved_by', sa.String(), nullable=True),
        sa.Column('success', sa.Boolean(), default=True),
        sa.Column('details', sa.Text(), nullable=True),
    )

    op.create_table('repo_patterns',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('repo', sa.String(), index=True),
        sa.Column('finding_type', sa.String(), nullable=True),
        sa.Column('occurrence_count', sa.Integer(), default=1),
        sa.Column('first_seen', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.Column('is_false_positive', sa.Boolean(), default=False),
    )

    op.create_table('findings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('scan_id', sa.Integer(), sa.ForeignKey('scan_results.id'), nullable=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('status', sa.String(), default='open'),
        sa.Column('assigned_to', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table('scan_schedules',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('repo_name', sa.String(), nullable=False),
        sa.Column('cron_expression', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('last_run_at', sa.DateTime(), nullable=True),
        sa.Column('next_run_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table('notification_settings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('channel', sa.String(), nullable=False),
        sa.Column('destination', sa.String(), nullable=False),
        sa.Column('on_critical', sa.Boolean(), default=True),
        sa.Column('on_new_finding', sa.Boolean(), default=True),
        sa.Column('on_scan_complete', sa.Boolean(), default=False),
        sa.Column('is_active', sa.Boolean(), default=True),
    )

    op.create_table('integrations',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('access_token_encrypted', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
    )


def downgrade() -> None:
    op.drop_table('integrations')
    op.drop_table('notification_settings')
    op.drop_table('scan_schedules')
    op.drop_table('findings')
    op.drop_table('repo_patterns')
    op.drop_table('remediation_actions')
    op.drop_table('scan_results')
    op.drop_table('audit_logs')
    op.drop_table('stripe_events')
    op.drop_table('user_repos')
    op.drop_table('api_keys')
    op.drop_table('sessions')
    op.drop_table('invitations')
    op.drop_table('organization_members')
    op.drop_table('users')
    op.drop_table('organizations')