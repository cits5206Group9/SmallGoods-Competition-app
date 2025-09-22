"""Add competition_id to referee table

Revision ID: add_referee_competition_link
Revises: 70a265a4a7d7
Create Date: 2025-09-21 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_referee_competition_link'
down_revision = '70a265a4a7d7'
branch_labels = None
depends_on = None

def upgrade():
    # Add competition_id column to referee table
    op.add_column('referee', sa.Column('competition_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_referee_competition', 'referee', 'competition', ['competition_id'], ['id'])

def downgrade():
    # Remove foreign key and column
    op.drop_constraint('fk_referee_competition', 'referee', type_='foreignkey')
    op.drop_column('referee', 'competition_id')