from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("AGENTSEC_DB_URL", "sqlite:////home/ashnikov/projects/devsec-agent/agentsec.db")
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class ScanResult(Base):
    __tablename__ = "scan_results"

    id             = Column(Integer, primary_key=True, index=True)
    scanned_at     = Column(DateTime, default=datetime.utcnow)
    repo           = Column(String, index=True)
    secrets_found  = Column(Integer, default=0)
    vulns_found    = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    brain_winner   = Column(String, nullable=True)
    brain_score    = Column(Float, nullable=True)
    tokens_used    = Column(Integer, default=0)
    analysis       = Column(Text, nullable=True)
    status         = Column(String, default="complete")

class RemediationAction(Base):
    __tablename__ = "remediation_actions"

    id          = Column(Integer, primary_key=True, index=True)
    actioned_at = Column(DateTime, default=datetime.utcnow)
    repo        = Column(String, index=True)
    action      = Column(String)
    approved_by = Column(String, nullable=True)
    success     = Column(Boolean, default=True)
    details     = Column(Text, nullable=True)

class RepoPattern(Base):
    __tablename__ = "repo_patterns"

    id              = Column(Integer, primary_key=True, index=True)
    repo            = Column(String, index=True)
    finding_type    = Column(String)
    occurrence_count= Column(Integer, default=1)
    first_seen      = Column(DateTime, default=datetime.utcnow)
    last_seen       = Column(DateTime, default=datetime.utcnow)
    is_false_positive = Column(Boolean, default=False)

def init_db():
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")

if __name__ == "__main__":
    init_db()
