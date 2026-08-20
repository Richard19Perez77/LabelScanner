package com.labelscanner.scanner

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.min

object FieldExtractor {
  fun extract(blocks: List<OcrBlock>, spec: FieldSpec): ExtractedField {
    val fullText = blocks.joinToString("\n") { it.text }

    sameLineCandidate(fullText, spec)?.let { candidate ->
      val result = Validators.validateField(spec, candidate)
      if (result.value != null) {
        return result
      }
    }

    spatialCandidate(blocks, spec)?.let { candidate ->
      val result = Validators.validateField(spec, candidate)
      if (result.valid) {
        return result
      }
    }

    regexHunt(fullText, spec)?.let { candidate ->
      return Validators.validateField(spec, candidate)
    }

    return Validators.validateField(spec, null)
  }

  fun extractAll(blocks: List<OcrBlock>, template: TemplateProfile): List<ExtractedField> {
    return template.fields.map { extract(blocks, it) }
  }

  internal fun sameLineCandidate(fullText: String, spec: FieldSpec): String? {
    val anchors = spec.anchors.joinToString("|") { Regex.escape(it) }
    val pattern = Regex("(?i)(?:$anchors)\\s*[:#.-]?\\s*([^\\s]+)")
    return pattern.find(fullText)?.groupValues?.getOrNull(1)
  }

  internal fun spatialCandidate(blocks: List<OcrBlock>, spec: FieldSpec): String? {
    val anchor = blocks.firstOrNull { block ->
      spec.anchors.any { anchor -> block.text.contains(anchor, ignoreCase = true) }
    } ?: return null

    val neighbors = blocks.filter { it !== anchor && it.text.isNotBlank() }
    val nearest = neighbors.minByOrNull { distance(anchor, it) } ?: return null
    return tokenize(nearest.text).firstOrNull()
  }

  internal fun regexHunt(fullText: String, spec: FieldSpec): String? {
    return Regex(spec.regex).find(fullText)?.value
  }

  private fun tokenize(text: String): List<String> {
    return text.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
  }

  private fun distance(a: OcrBlock, b: OcrBlock): Double {
    val sameLineBias = if (abs(a.centerY - b.centerY) < min(a.height, b.height) * 1.2) 0.25 else 1.0
    return hypot((b.centerX - a.centerX).toDouble(), (b.centerY - a.centerY).toDouble()) * sameLineBias
  }
}
