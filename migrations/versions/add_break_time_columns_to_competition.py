"""add_break_time_columns_to_competition

Revision ID: abc123def456
Revises: dd1cdc0a9afe
Create Date: 2025-10-10 22:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'abc123def456'
down_revision = 'd36e2219443d'
branch_labels = None
depends_on = None


def upgrade():
    # Add break time columns to competition table
    with op.batch_alter_table('competition', schema=None) as batch_op:
        batch_op.add_column(sa.Column('breaktime_between_events', sa.Integer(), nullable=True, server_default='300'))
        batch_op.add_column(sa.Column('breaktime_between_flights', sa.Integer(), nullable=True, server_default='180'))


def downgrade():
    # Remove break time columns from competition table
    with op.batch_alter_table('competition', schema=None) as batch_op:
        batch_op.drop_column('breaktime_between_flights')
        batch_op.drop_column('breaktime_between_events')
