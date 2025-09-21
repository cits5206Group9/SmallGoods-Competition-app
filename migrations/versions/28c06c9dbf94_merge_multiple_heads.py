"""merge multiple heads

Revision ID: 28c06c9dbf94
Revises: 514d3cf55ebd, 0a700744d681
Create Date: 2025-09-21 21:25:41.096127

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '28c06c9dbf94'
down_revision = ('514d3cf55ebd', '0a700744d681')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
