"""
Integration tests for the competition app
Tests multiple components working together
"""
import pytest
from datetime import datetime, date
from app import create_app
from app.models import (
    User, UserRole, Competition, CompetitionDay, SportCategory,
    Exercise, CompetitionType, Athlete, AthleteEntry, Attempt,
    AttemptResult, RefereeAssignment, RefereeDecision, Timer, Score
)
from app.extensions import db


class TestCompetitionWorkflow:
    """Test complete competition workflow integration"""
    
    @pytest.fixture()
    def competition_setup(self, app):
        """Set up a complete competition structure"""
        with app.app_context():
            # Create users
            admin = User(
                email="admin@example.com",
                password_hash="hash",
                first_name="Admin",
                last_name="User",
                role=UserRole.ADMIN
            )
            referee = User(
                email="ref@example.com",
                password_hash="hash",
                first_name="Head",
                last_name="Referee",
                role=UserRole.REFEREE
            )
            
            # Create competition structure
            competition = Competition(
                name="National Championships 2025",
                start_date=date(2025, 6, 1),
                end_date=date(2025, 6, 1)
            )
            
            day1 = CompetitionDay(
                competition=competition,
                day_number=1,
                date=date(2025, 6, 1)
            )
            
            olympic = SportCategory(
                competition_day=day1,
                name="Olympic"
            )
            
            snatch = Exercise(
                sport_category=olympic,
                name="snatch",
                order=1,
                attempt_time_limit=60,
                break_time_default=120
            )
            
            oly_type = CompetitionType(
                exercise=snatch,
                name="Oly"
            )
            
            # Create athletes
            athlete1 = Athlete(
                first_name="John",
                last_name="Lifter",
                email="john@example.com",
                weight_category="73kg",
                bodyweight=72.5
            )
            
            athlete2 = Athlete(
                first_name="Jane",
                last_name="Strong",
                email="jane@example.com",
                weight_category="63kg",
                bodyweight=62.8
            )
            
            # Add and commit basic objects first to get IDs
            db.session.add_all([
                admin, referee, competition, day1, olympic, snatch, oly_type,
                athlete1, athlete2
            ])
            db.session.commit()
            
            # Now create objects that need the IDs
            entry1 = AthleteEntry(
                competition_type_id=oly_type.id,
                athlete_id=athlete1.id,
                entry_order=1
            )
            
            entry2 = AthleteEntry(
                competition_type_id=oly_type.id,
                athlete_id=athlete2.id,
                entry_order=2
            )
            
            # Create referee assignment
            ref_assignment = RefereeAssignment(
                user_id=referee.id,
                competition_type_id=oly_type.id,
                referee_position="head"
            )
            
            db.session.add_all([entry1, entry2, ref_assignment])
            db.session.commit()
            
            return {
                'competition': competition,
                'oly_type': oly_type,
                'oly_type_id': oly_type.id,
                'entry1': entry1,
                'entry1_id': entry1.id,
                'entry2': entry2,
                'entry2_id': entry2.id,
                'athlete1_id': athlete1.id,
                'athlete2_id': athlete2.id,
                'referee': referee,
                'referee_id': referee.id,
                'ref_assignment': ref_assignment
            }

    def test_complete_attempt_workflow(self, app, competition_setup):
        """Test complete attempt workflow with referee decisions"""
        with app.app_context():
            setup = competition_setup
            
            # Create 3 attempts for athlete 1
            attempt1 = Attempt(
                athlete_entry_id=setup['entry1_id'],
                attempt_number=1,
                requested_weight=100.0
            )
            
            attempt2 = Attempt(
                athlete_entry_id=setup['entry1_id'],
                attempt_number=2,
                requested_weight=105.0
            )
            
            attempt3 = Attempt(
                athlete_entry_id=setup['entry1_id'],
                attempt_number=3,
                requested_weight=110.0
            )
            
            db.session.add_all([attempt1, attempt2, attempt3])
            db.session.commit()
            
            # Create referee decisions
            decision1 = RefereeDecision(
                attempt=attempt1,
                referee_assignment=setup['ref_assignment'],
                decision=AttemptResult.GOOD
            )
            
            decision2 = RefereeDecision(
                attempt=attempt2,
                referee_assignment=setup['ref_assignment'],
                decision=AttemptResult.GOOD
            )
            
            decision3 = RefereeDecision(
                attempt=attempt3,
                referee_assignment=setup['ref_assignment'],
                decision=AttemptResult.BAD
            )
            
            db.session.add_all([decision1, decision2, decision3])
            
            # Update attempt results based on referee decisions
            attempt1.final_result = AttemptResult.GOOD
            attempt1.actual_weight = attempt1.requested_weight
            attempt2.final_result = AttemptResult.GOOD  
            attempt2.actual_weight = attempt2.requested_weight
            attempt3.final_result = AttemptResult.BAD
            
            db.session.commit()
            
            # Verify the workflow - reload from database
            athlete_entry = db.session.get(AthleteEntry, setup['entry1_id'])
            assert len(athlete_entry.attempts) == 3
            
            good_attempts = [a for a in athlete_entry.attempts if a.final_result == AttemptResult.GOOD]
            assert len(good_attempts) == 2
            
            best_weight = max(a.actual_weight for a in good_attempts)
            assert best_weight == 105.0

    def test_timer_integration(self, app, competition_setup):
        """Test timer integration with attempts"""
        with app.app_context():
            setup = competition_setup
            
            # Create timer
            timer = Timer(
                competition_type_id=setup['oly_type_id'],
                timer_type="attempt",
                duration_seconds=60,
                remaining_seconds=60
            )
            db.session.add(timer)
            db.session.commit()
            
            # Create attempt
            attempt = Attempt(
                athlete_entry_id=setup['entry1_id'],
                attempt_number=1,
                requested_weight=100.0,
                started_at=datetime.utcnow()
            )
            db.session.add(attempt)
            db.session.commit()
            
            # Link timer to attempt
            timer.current_attempt_id = attempt.id
            timer.current_athlete_id = setup['athlete1_id']
            timer.is_running = True
            timer.started_at = datetime.utcnow()
            
            db.session.commit()
            
            # Verify integration - reload timer to get relationships
            timer = db.session.get(Timer, timer.id)
            assert timer.current_attempt.attempt_number == 1
            assert timer.current_athlete.first_name == "John"
            assert timer.is_running is True

    def test_scoring_integration(self, app, competition_setup):
        """Test score calculation integration"""
        with app.app_context():
            setup = competition_setup
            
            # Create attempts for both athletes
            # Athlete 1 attempts
            a1_attempt1 = Attempt(
                athlete_entry=setup['entry1'],
                attempt_number=1,
                requested_weight=100.0,
                actual_weight=100.0,
                final_result=AttemptResult.GOOD
            )
            a1_attempt2 = Attempt(
                athlete_entry=setup['entry1'],
                attempt_number=2,
                requested_weight=105.0,
                actual_weight=105.0,
                final_result=AttemptResult.GOOD
            )
            a1_attempt3 = Attempt(
                athlete_entry=setup['entry1'],
                attempt_number=3,
                requested_weight=110.0,
                actual_weight=110.0,
                final_result=AttemptResult.BAD
            )
            
            # Athlete 2 attempts
            a2_attempt1 = Attempt(
                athlete_entry=setup['entry2'],
                attempt_number=1,
                requested_weight=95.0,
                actual_weight=95.0,
                final_result=AttemptResult.GOOD
            )
            a2_attempt2 = Attempt(
                athlete_entry=setup['entry2'],
                attempt_number=2,
                requested_weight=100.0,
                actual_weight=100.0,
                final_result=AttemptResult.BAD
            )
            a2_attempt3 = Attempt(
                athlete_entry=setup['entry2'],
                attempt_number=3,
                requested_weight=102.0,
                actual_weight=102.0,
                final_result=AttemptResult.GOOD
            )
            
            db.session.add_all([
                a1_attempt1, a1_attempt2, a1_attempt3,
                a2_attempt1, a2_attempt2, a2_attempt3
            ])
            db.session.commit()
            
            # Calculate scores
            # Athlete 1 best: 105.0
            score1 = Score(
                athlete_entry=setup['entry1'],
                best_attempt_weight=105.0,
                total_score=105.0,
                rank=1,
                score_type="exercise"
            )
            
            # Athlete 2 best: 102.0
            score2 = Score(
                athlete_entry=setup['entry2'],
                best_attempt_weight=102.0,
                total_score=102.0,
                rank=2,
                score_type="exercise"
            )
            
            db.session.add_all([score1, score2])
            db.session.commit()
            
            # Verify scoring
            assert score1.rank == 1
            assert score2.rank == 2
            assert score1.best_attempt_weight > score2.best_attempt_weight


class TestDatabaseIntegrity:
    """Test database constraints and relationships"""
    
    def test_cascade_deletion(self, app):
        """Test that related records are properly deleted"""
        with app.app_context():
            # Create competition structure
            competition = Competition(
                name="Test Competition",
                start_date=date(2025, 6, 1),
                end_date=date(2025, 6, 1)
            )
            day = CompetitionDay(
                competition=competition,
                day_number=1,
                date=date(2025, 6, 1)
            )
            category = SportCategory(
                competition_day=day,
                name="Olympic"
            )
            
            db.session.add_all([competition, day, category])
            db.session.commit()
            
            competition_id = competition.id
            day_id = day.id
            category_id = category.id
            
            # Delete competition
            db.session.delete(competition)
            db.session.commit()
            
            # Verify cascade deletion
            assert db.session.get(Competition, competition_id) is None
            assert db.session.get(CompetitionDay, day_id) is None
            assert db.session.get(SportCategory, category_id) is None

    def test_unique_constraints(self, app):
        """Test unique constraints work properly"""
        with app.app_context():
            user1 = User(
                email="test@example.com",
                password_hash="hash1",
                first_name="User",
                last_name="One"
            )
            user2 = User(
                email="test@example.com",  # Same email
                password_hash="hash2",
                first_name="User",
                last_name="Two"
            )
            
            db.session.add(user1)
            db.session.commit()
            
            db.session.add(user2)
            with pytest.raises(Exception):  # Should raise integrity error
                db.session.commit()

    def test_foreign_key_constraints(self, app):
        """Test foreign key constraints"""
        with app.app_context():
            # SQLite needs foreign key constraints enabled
            from sqlalchemy import text
            db.session.execute(text("PRAGMA foreign_keys=ON"))
            
            # Try to create an attempt without valid athlete_entry_id
            attempt = Attempt(
                athlete_entry_id=999999,  # Non-existent ID
                attempt_number=1,
                requested_weight=100.0
            )
            
            db.session.add(attempt)
            with pytest.raises(Exception):  # Should raise foreign key error
                db.session.commit()


class TestQueryPerformance:
    """Test complex queries and relationships"""
    
    def test_complex_athlete_query(self, app):
        """Test complex query across multiple tables"""
        with app.app_context():
            # Create test data
            competition = Competition(
                name="Test", start_date=date(2025, 6, 1), end_date=date(2025, 6, 1)
            )
            day = CompetitionDay(competition=competition, day_number=1, date=date(2025, 6, 1))
            category = SportCategory(competition_day=day, name="Olympic")
            exercise = Exercise(sport_category=category, name="snatch", order=1)
            comp_type = CompetitionType(exercise=exercise, name="Oly")
            
            athlete = Athlete(first_name="John", last_name="Doe")
            
            # Add and commit basic objects first
            db.session.add_all([
                competition, day, category, exercise, comp_type, athlete
            ])
            db.session.commit()
            
            # Create entry with IDs
            entry = AthleteEntry(competition_type_id=comp_type.id, athlete_id=athlete.id)
            db.session.add(entry)
            db.session.commit()
            
            # Create attempts with IDs
            attempt1 = Attempt(
                athlete_entry_id=entry.id, attempt_number=1, 
                requested_weight=100.0, final_result=AttemptResult.GOOD
            )
            attempt2 = Attempt(
                athlete_entry_id=entry.id, attempt_number=2,
                requested_weight=105.0, final_result=AttemptResult.GOOD
            )
            
            db.session.add_all([attempt1, attempt2])
            db.session.commit()
            
            # Complex query: Get athlete with their best attempt
            query = db.session.query(Athlete).join(AthleteEntry).join(Attempt).filter(
                Attempt.final_result == AttemptResult.GOOD
            ).order_by(Attempt.requested_weight.desc()).first()
            
            assert query is not None
            assert query.first_name == "John"
