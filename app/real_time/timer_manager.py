"""
Server-side timer management for real-time competition synchronization
"""

import time
import threading
from typing import Dict, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class TimerState(Enum):
    """Timer state enumeration"""

    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"
    EXPIRED = "expired"


@dataclass
class TimerData:
    """Timer data structure"""

    competition_id: int
    timer_id: str
    duration: int  # seconds
    remaining: int  # seconds
    state: TimerState
    start_time: Optional[float] = None
    pause_time: Optional[float] = None
    type: str = "attempt"  # attempt, break, competition


class CompetitionTimer:
    """
    Individual timer instance for competition events
    """

    def __init__(
        self,
        competition_id: int,
        timer_id: str,
        duration: int,
        timer_type: str = "attempt",
        callback: Optional[Callable] = None,
    ):
        self.competition_id = competition_id
        self.timer_id = timer_id
        self.duration = duration
        self.type = timer_type
        self.callback = callback

        self.remaining = duration
        self.state = TimerState.STOPPED
        self.start_time = None
        self.pause_time = None

        self._thread = None
        self._stop_event = threading.Event()

    def start(self) -> bool:
        """Start the timer"""
        if self.state == TimerState.RUNNING:
            return False

        if self.state == TimerState.PAUSED and self.pause_time:
            # Resume from pause
            pause_duration = time.time() - self.pause_time
            self.start_time += pause_duration
        else:
            # Fresh start
            self.start_time = time.time()
            self.remaining = self.duration

        self.state = TimerState.RUNNING
        self.pause_time = None

        # Start countdown thread
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._countdown_loop)
        self._thread.daemon = True
        self._thread.start()

        logger.info(
            f"Timer {self.timer_id} started for competition {self.competition_id}"
        )
        return True

    def pause(self) -> bool:
        """Pause the timer"""
        if self.state != TimerState.RUNNING:
            return False

        self.state = TimerState.PAUSED
        self.pause_time = time.time()
        self._stop_event.set()

        # Update remaining time
        if self.start_time:
            elapsed = self.pause_time - self.start_time
            self.remaining = max(0, self.duration - int(elapsed))

        logger.info(
            f"Timer {self.timer_id} paused for competition {self.competition_id}"
        )
        return True

    def stop(self) -> bool:
        """Stop the timer"""
        if self.state == TimerState.STOPPED:
            return False

        self.state = TimerState.STOPPED
        self.remaining = self.duration
        self.start_time = None
        self.pause_time = None
        self._stop_event.set()

        logger.info(
            f"Timer {self.timer_id} stopped for competition {self.competition_id}"
        )
        return True

    def reset(self, new_duration: Optional[int] = None) -> bool:
        """Reset the timer"""
        self.stop()

        if new_duration is not None:
            self.duration = new_duration

        self.remaining = self.duration
        logger.info(
            f"Timer {self.timer_id} reset for competition {self.competition_id}"
        )
        return True

    def get_data(self) -> TimerData:
        """Get current timer data"""
        # Update remaining time if running
        if self.state == TimerState.RUNNING and self.start_time:
            elapsed = time.time() - self.start_time
            self.remaining = max(0, self.duration - int(elapsed))

            if self.remaining <= 0:
                self.state = TimerState.EXPIRED

        return TimerData(
            competition_id=self.competition_id,
            timer_id=self.timer_id,
            duration=self.duration,
            remaining=self.remaining,
            state=self.state,
            start_time=self.start_time,
            pause_time=self.pause_time,
            type=self.type,
        )

    def _countdown_loop(self):
        """Internal countdown loop"""
        while not self._stop_event.is_set() and self.state == TimerState.RUNNING:
            if self.start_time:
                elapsed = time.time() - self.start_time
                self.remaining = max(0, self.duration - int(elapsed))

                if self.remaining <= 0:
                    self.state = TimerState.EXPIRED
                    if self.callback:
                        self.callback(self.get_data())
                    break

                # Broadcast update if callback provided
                if self.callback:
                    self.callback(self.get_data())

            time.sleep(0.1)  # Update every 100ms for smooth updates


class TimerManager:
    """
    Manages multiple competition timers
    """

    def __init__(self):
        self.timers: Dict[str, CompetitionTimer] = {}
        self._lock = threading.Lock()

    def create_timer(
        self,
        competition_id: int,
        timer_id: str,
        duration: int,
        timer_type: str = "attempt",
        callback: Optional[Callable] = None,
    ) -> str:
        """Create a new timer"""
        full_timer_id = f"{competition_id}_{timer_id}"

        with self._lock:
            if full_timer_id in self.timers:
                # Stop existing timer
                self.timers[full_timer_id].stop()

            self.timers[full_timer_id] = CompetitionTimer(
                competition_id, timer_id, duration, timer_type, callback
            )

        logger.info(f"Created timer {full_timer_id} with duration {duration}s")
        return full_timer_id

    def start_timer(self, competition_id: int, timer_id: str) -> bool:
        """Start a timer"""
        full_timer_id = f"{competition_id}_{timer_id}"

        with self._lock:
            if full_timer_id in self.timers:
                return self.timers[full_timer_id].start()

        logger.warning(f"Timer {full_timer_id} not found")
        return False

    def pause_timer(self, competition_id: int, timer_id: str) -> bool:
        """Pause a timer"""
        full_timer_id = f"{competition_id}_{timer_id}"

        with self._lock:
            if full_timer_id in self.timers:
                return self.timers[full_timer_id].pause()

        logger.warning(f"Timer {full_timer_id} not found")
        return False

    def stop_timer(self, competition_id: int, timer_id: str) -> bool:
        """Stop a timer"""
        full_timer_id = f"{competition_id}_{timer_id}"

        with self._lock:
            if full_timer_id in self.timers:
                return self.timers[full_timer_id].stop()

        logger.warning(f"Timer {full_timer_id} not found")
        return False

    def reset_timer(
        self, competition_id: int, timer_id: str, new_duration: Optional[int] = None
    ) -> bool:
        """Reset a timer"""
        full_timer_id = f"{competition_id}_{timer_id}"

        with self._lock:
            if full_timer_id in self.timers:
                return self.timers[full_timer_id].reset(new_duration)

        logger.warning(f"Timer {full_timer_id} not found")
        return False

    def get_timer_data(self, competition_id: int, timer_id: str) -> Optional[TimerData]:
        """Get timer data"""
        full_timer_id = f"{competition_id}_{timer_id}"

        with self._lock:
            if full_timer_id in self.timers:
                return self.timers[full_timer_id].get_data()

        return None

    def get_competition_timers(self, competition_id: int) -> Dict[str, TimerData]:
        """Get all timers for a competition"""
        result = {}

        with self._lock:
            for full_timer_id, timer in self.timers.items():
                if timer.competition_id == competition_id:
                    result[timer.timer_id] = timer.get_data()

        return result

    def cleanup_competition(self, competition_id: int):
        """Clean up all timers for a competition"""
        to_remove = []

        with self._lock:
            for full_timer_id, timer in self.timers.items():
                if timer.competition_id == competition_id:
                    timer.stop()
                    to_remove.append(full_timer_id)

            for timer_id in to_remove:
                del self.timers[timer_id]

        logger.info(
            f"Cleaned up {len(to_remove)} timers for competition {competition_id}"
        )


# Global timer manager instance
timer_manager = TimerManager()
