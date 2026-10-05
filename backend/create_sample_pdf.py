import os
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def create_sample_docs():
    output_dir = Path(__file__).resolve().parent / "sample_docs"
    output_dir.mkdir(parents=True, exist_ok=True)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=14
    )
    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=10,
        spaceAfter=8
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=8
    )

    # 1. Annual Financial Report 2024 (4 pages)
    fin_pdf_path = output_dir / "Annual_Financial_Report_2024.pdf"
    doc1 = SimpleDocTemplate(str(fin_pdf_path), pagesize=letter, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    story1 = []

    # Page 1: Overview & Executive Summary
    story1.append(Paragraph("Apex Global Technologies — Annual Financial Report 2024", title_style))
    story1.append(Paragraph("Executive Summary & Business Highlights", h2_style))
    story1.append(Paragraph("For the fiscal year 2024, Apex Global Technologies reported consolidated revenue of $148.5 million, representing a 28.4% increase year-over-year compared to $115.6 million in FY2023.", body_style))
    story1.append(Paragraph("The Enterprise AI Cloud division was the largest revenue driver, generating $82.4 million (55.5% of total sales). Gross margins expanded from 68.2% in FY2023 to 74.1% in FY2024 due to infrastructure optimizations and proprietary vector caching architectures.", body_style))
    story1.append(Paragraph("Total operating income reached $34.2 million, up from $21.5 million in the preceding year. Free cash flow stood at $29.8 million by fiscal year end.", body_style))
    story1.append(PageBreak())

    # Page 2: Operational Expenditures & Research
    story1.append(Paragraph("Section 2: Research & Development and Operating Expenditures", title_style))
    story1.append(Paragraph("R&D Investments & Infrastructure", h2_style))
    story1.append(Paragraph("Research and Development expenses amounted to $38.6 million in FY2024, reflecting an aggressive commitment to next-generation retrieval-augmented generation and autonomous agent swarms.", body_style))
    story1.append(Paragraph("The company established two new research laboratories in Zurich and Austin, employing 120 specialized research scientists and engineers.", body_style))
    story1.append(Paragraph("Sales and Marketing expenditure totaled $24.1 million, driven by expansion into the European and Asia-Pacific enterprise markets. General and Administrative costs were controlled at $11.6 million.", body_style))
    story1.append(PageBreak())

    # Page 3: Balance Sheet & Capital Allocations
    story1.append(Paragraph("Section 3: Liquidity, Debt, and Capital Structure", title_style))
    story1.append(Paragraph("Balance Sheet Robustness", h2_style))
    story1.append(Paragraph("As of December 31, 2024, cash, cash equivalents, and short-term marketable securities totaled $92.3 million, with zero outstanding long-term debt.", body_style))
    story1.append(Paragraph("The Board of Directors authorized a $25 million share repurchase program, of which $12.4 million was executed during the fourth quarter.", body_style))
    story1.append(Paragraph("Capital expenditures for the year were $14.2 million, primarily allocated to high-performance GPU clusters and private cloud data centers in North America.", body_style))
    story1.append(PageBreak())

    # Page 4: Guidance & Future Outlook
    story1.append(Paragraph("Section 4: Fiscal Year 2025 Strategic Guidance", title_style))
    story1.append(Paragraph("Outlook & Key Projections", h2_style))
    story1.append(Paragraph("Management forecasts FY2025 revenue between $185 million and $195 million, projecting continued enterprise adoption of generative AI copilots and document intelligence platforms.", body_style))
    story1.append(Paragraph("Operating margin is anticipated to remain between 24% and 27%, with sustained investments in sovereign AI compliance and privacy-preserving multi-tenant deployments.", body_style))
    story1.append(Paragraph("Chief Executive Officer Dr. Elena Vance stated: 'Our focus on strict factual grounding and zero hallucination has made our platform the benchmark for regulated enterprise workflows.'", body_style))

    doc1.build(story1)

    # 2. Research Paper: Autonomous RAG Agents (3 pages)
    res_pdf_path = output_dir / "Research_Paper_AI_Agents.pdf"
    doc2 = SimpleDocTemplate(str(res_pdf_path), pagesize=letter, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    story2 = []

    # Page 1: Abstract & Introduction
    story2.append(Paragraph("Self-Correcting Retrieval-Augmented Generation for Complex Reasoning", title_style))
    story2.append(Paragraph("Abstract & Problem Formulation", h2_style))
    story2.append(Paragraph("Standard large language models frequently hallucinate when answering queries regarding domain-specific or private documents. In this paper, we present VeriRAG, a dual-stage verification framework that enforces strict grounding on retrieved document chunks.", body_style))
    story2.append(Paragraph("Our architecture combines dense vector retrieval via FAISS and all-MiniLM-L6-v2 embeddings with a zero-temperature LLM validation head. We demonstrate that filtering context chunks below a cosine similarity threshold of 0.20 reduces false factual claims by 94.6%.", body_style))
    story2.append(PageBreak())

    # Page 2: Methodology & Chunking Strategy
    story2.append(Paragraph("Methodology & Vector Indexing Architecture", title_style))
    story2.append(Paragraph("Chunking and Vector Similarity", h2_style))
    story2.append(Paragraph("The ingestion pipeline breaks PDF documents into sliding chunks of 600 tokens with an overlap of 100 tokens, preserving strict page-level metadata. Embeddings are generated using a 384-dimensional sentence transformer model.", body_style))
    story2.append(Paragraph("Similarity searches utilize inner product (cosine similarity) indexed with FAISS IndexFlatIP. For conversational multi-turn sessions, the query is reformulated using a specialized query rewriter before vector retrieval.", body_style))
    story2.append(PageBreak())

    # Page 3: Experimental Results & Benchmarks
    story2.append(Paragraph("Empirical Evaluation & Performance", title_style))
    story2.append(Paragraph("Benchmark Results", h2_style))
    story2.append(Paragraph("Evaluations conducted on the MultiDoc-QA benchmark demonstrate an exact match accuracy of 91.2% and a hallucination rate under 0.8% across 1,500 legal and financial queries.", body_style))
    story2.append(Paragraph("Average retrieval latency was measured at 18 milliseconds on a standard CPU, while end-to-end token generation latency through Groq LPUs averaged 220 milliseconds.", body_style))
    story2.append(Paragraph("Conclusion: Strict document-grounded RAG with page-level citations significantly outperforms open-domain generation in factual fidelity.", body_style))

    doc2.build(story2)
    print(f"Sample PDFs successfully created in {output_dir}")

if __name__ == "__main__":
    create_sample_docs()
